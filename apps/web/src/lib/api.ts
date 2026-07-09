const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const CSRF_COOKIE = "csrfToken";
const CSRF_HEADER = "X-CSRF-Token";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Auth lives in httpOnly cookies now (see apps/api's AuthController) —
// there's no token for JS to hold, read, or clear anymore. The CSRF cookie
// is the one deliberate exception: it's not httpOnly specifically so this
// can read it back and echo it as a header (double-submit pattern).
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// The CSRF cookie is set alongside the (httpOnly, JS-invisible) auth
// cookies on every login/refresh and cleared on logout, so its presence is
// a reasonable client-side proxy for "there's probably an active session" —
// used only to skip a pointless /users/me call for a visitor who's
// obviously signed out, not as an actual auth check.
export function hasSession(): boolean {
  return getCsrfToken() !== null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  // Only affects the 401-triggered refresh-and-retry below — the auth
  // bootstrap endpoints (login/signup) are hit while there may be no valid
  // session yet, so a 401 from them is a real failure, not "access token
  // expired, go refresh."
  skipAuth?: boolean;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) headers[CSRF_HEADER] = csrfToken;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth && !isRetry) {
    // Single-flight refresh: concurrent 401s from parallel requests all
    // await the same in-flight refresh instead of each racing to rotate
    // the refresh token — only one rotation can win server-side (see the
    // reuse-detection logic in auth.service.ts), so a naive per-request
    // refresh would make the others fail with "no longer valid".
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      return request<T>(path, options, true);
    }
    throw new ApiError(401, "Session expired");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = Array.isArray(data?.message) ? data.message.join(", ") : (data?.message ?? "Request failed");
    throw new ApiError(res.status, message);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
